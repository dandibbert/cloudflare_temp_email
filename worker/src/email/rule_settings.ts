import { EmailRuleSettings } from "../models";
import { CONSTANTS } from "../constants";
import { normalizeEmailRuleSettings } from "./content_block";

export { normalizeEmailRuleSettings } from "./content_block";

const DEFAULT_EMAIL_RULE_SETTINGS: EmailRuleSettings = {
    blockReceiveUnknowAddressEmail: false,
    contentBlockList: [],
    emailForwardingList: [],
};

export const getEmailRuleSettingsForReceive = async (env: Bindings): Promise<EmailRuleSettings> => {
    const value = await env.DB.prepare(
        "SELECT value FROM settings WHERE key = ?"
    ).bind(CONSTANTS.EMAIL_RULE_SETTINGS_KEY).first<string>("value");
    if (value === null || value === undefined || value === "") {
        return DEFAULT_EMAIL_RULE_SETTINGS;
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(value);
    } catch {
        throw new Error("Invalid email rule settings JSON");
    }
    const settings = normalizeEmailRuleSettings(parsed);
    if (!settings) throw new Error("Invalid email rule settings");
    return settings;
}
