import type { EmailRuleSettings } from "../models";

const MAX_CONTENT_BLOCK_KEYWORDS = 200;
const MAX_CONTENT_BLOCK_KEYWORD_LENGTH = 200;

const normalizeText = (value: unknown): string => {
    if (typeof value !== "string") return "";
    return value.normalize("NFKC").toLowerCase();
}

const decodeNumericEntity = (value: string, radix: number): string => {
    const codePoint = parseInt(value, radix);
    if (!Number.isInteger(codePoint)
        || codePoint < 0
        || codePoint > 0x10FFFF
        || (codePoint >= 0xD800 && codePoint <= 0xDFFF)
    ) {
        return " ";
    }
    return String.fromCodePoint(codePoint);
}

const decodeHtmlEntities = (html: string): string => html
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;|&#38;/gi, "&")
    .replace(/&lt;|&#60;/gi, "<")
    .replace(/&gt;|&#62;/gi, ">")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => decodeNumericEntity(hex, 16))
    .replace(/&#([0-9]+);/g, (_, decimal: string) => decodeNumericEntity(decimal, 10));

const htmlToVisibleText = (html: string): string => decodeHtmlEntities(
    html
        .replace(/<(script|style|head|title|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
        .replace(/<!--([\s\S]*?)-->/g, " ")
        .replace(/<\/?(?:address|article|aside|blockquote|br|dd|div|dl|dt|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|tbody|td|tfoot|th|thead|tr|ul)\b[^>]*>/gi, " ")
        .replace(/<[^>]+>/g, "")
).replace(/\s+/g, " ").trim();

export const normalizeContentBlockList = (values: unknown): string[] => {
    if (!Array.isArray(values)) return [];
    const normalized = values
        .filter((value): value is string => typeof value === "string")
        .map((value) => normalizeText(value).replace(/\s+/g, " ").trim())
        .filter((value) => value.length > 0 && value.length <= MAX_CONTENT_BLOCK_KEYWORD_LENGTH);
    return [...new Set(normalized)].slice(0, MAX_CONTENT_BLOCK_KEYWORDS);
}

export const isValidContentBlockList = (values: unknown): values is string[] => {
    return Array.isArray(values)
        && values.length <= MAX_CONTENT_BLOCK_KEYWORDS
        && values.every((value) => {
            return typeof value === "string"
                && value.trim().length > 0
                && value.normalize("NFKC").trim().length <= MAX_CONTENT_BLOCK_KEYWORD_LENGTH;
        });
}

export const normalizeEmailRuleSettings = (value: unknown): EmailRuleSettings | null => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const settings = value as Record<string, unknown>;
    const blockUnknown = settings.blockReceiveUnknowAddressEmail ?? false;
    const contentBlockList = settings.contentBlockList ?? [];
    const emailForwardingList = settings.emailForwardingList ?? [];

    if (typeof blockUnknown !== "boolean"
        || !isValidContentBlockList(contentBlockList)
        || !Array.isArray(emailForwardingList)
    ) {
        return null;
    }

    return {
        blockReceiveUnknowAddressEmail: blockUnknown,
        contentBlockList: normalizeContentBlockList(contentBlockList),
        emailForwardingList: emailForwardingList as EmailRuleSettings["emailForwardingList"],
    };
}

export const findBlockedContentKeyword = (
    mail: { subject?: string, text?: string, html?: string },
    keywords: unknown,
): string | null => {
    const normalizedKeywords = normalizeContentBlockList(keywords);
    if (normalizedKeywords.length === 0) return null;

    const searchableParts = [
        mail.subject || "",
        mail.text || "",
        htmlToVisibleText(mail.html || ""),
    ].map((part) => normalizeText(part).replace(/\s+/g, " "));

    return normalizedKeywords.find((keyword) => {
        return searchableParts.some((part) => part.includes(keyword));
    }) || null;
}
