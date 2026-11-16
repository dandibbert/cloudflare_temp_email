export const supportsTelegramWebAppButton = (targetChatId: string): boolean => {
    const normalized = targetChatId.trim();
    // Telegram private user chat IDs are positive decimal IDs. Groups,
    // supergroups and channels use negative IDs, while @usernames are not
    // private-chat targets for web_app inline buttons.
    return /^[1-9]\d*$/.test(normalized);
}

export const isTelegramButtonTypeInvalidError = (error: unknown): boolean => {
    if (error instanceof Error && /BUTTON_TYPE_INVALID/i.test(error.message)) {
        return true;
    }
    if (!error || typeof error !== "object") return false;
    const candidate = error as {
        message?: unknown;
        response?: { description?: unknown };
    };
    const values = [candidate.message, candidate.response?.description];
    return values.some((value) => typeof value === "string" && /BUTTON_TYPE_INVALID/i.test(value));
}
