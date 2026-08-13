const normalizeRuleValue = (value: unknown): string => {
    if (typeof value !== "string") return "";
    return value.normalize("NFKC").trim().toLowerCase();
}

export const normalizeBlockList = (values: unknown): string[] => {
    if (!Array.isArray(values)) return [];
    return [...new Set(values.map(normalizeRuleValue).filter(Boolean))];
}

const getEnvelopeAddress = (value: string): string => {
    const normalized = normalizeRuleValue(value);
    const angleAddress = normalized.match(/<([^<>]+)>/)?.[1];
    return angleAddress?.trim() || normalized;
}

const getDomain = (address: string): string => {
    const atIndex = address.lastIndexOf("@");
    return atIndex >= 0 ? address.slice(atIndex + 1) : "";
}

const looksLikeDomainRule = (rule: string): boolean => {
    const withoutPrefix = rule.replace(/^\*?@?\.?/, "");
    return withoutPrefix.includes(".")
        && !withoutPrefix.includes(" ")
        && /^[a-z0-9.-]+$/i.test(withoutPrefix);
}

const matchesDomain = (senderDomain: string, rule: string): boolean => {
    const ruleDomain = rule.replace(/^\*?@?\.?/, "");
    return senderDomain === ruleDomain || senderDomain.endsWith(`.${ruleDomain}`);
}

export const isSenderBlockedByRules = (from: string, rules: unknown): boolean => {
    const sender = getEnvelopeAddress(from);
    const senderDomain = getDomain(sender);

    return normalizeBlockList(rules).some((rule) => {
        if (rule.includes("@") && !rule.startsWith("@") && !rule.startsWith("*@")) {
            return sender === rule;
        }
        if (senderDomain && looksLikeDomainRule(rule)) {
            return matchesDomain(senderDomain, rule);
        }
        return sender.includes(rule);
    });
}
