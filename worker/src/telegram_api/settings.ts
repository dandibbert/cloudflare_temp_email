import { Context } from "hono";
import { CONSTANTS } from "../constants";

export class TelegramSettings {
    enableAllowList: boolean;
    allowList: string[];
    miniAppUrl: string;
    enableGlobalMailPush: boolean;
    globalMailPushList: string[];

    constructor(
        enableAllowList: boolean, allowList: string[], miniAppUrl: string,
        enableGlobalMailPush: boolean, globalMailPushList: string[]
    ) {
        this.enableAllowList = enableAllowList;
        this.allowList = allowList;
        this.miniAppUrl = miniAppUrl;
        this.enableGlobalMailPush = enableGlobalMailPush;
        this.globalMailPushList = globalMailPushList;
    }
}

async function getTelegramSettings(c: Context<HonoCustomType>): Promise<Response> {
    const settings = await c.env.KV.get<TelegramSettings>(CONSTANTS.TG_KV_SETTINGS_KEY, "json");
    return c.json(settings || new TelegramSettings(false, [], "", false, []));
}


async function saveTelegramSettings(c: Context<HonoCustomType>): Promise<Response> {
    const settings = await c.req.json<TelegramSettings>();
    await c.env.KV.put(CONSTANTS.TG_KV_SETTINGS_KEY, JSON.stringify(settings));
    return c.json({ success: true })
}

async function updateTelegramMiniAppUrl(c: Context<HonoCustomType>): Promise<Response> {
    let body: { miniAppUrl?: unknown };
    try {
        body = await c.req.json<{ miniAppUrl?: unknown }>();
    } catch {
        return c.json({ success: false, message: "Invalid JSON body" }, 400);
    }

    if (typeof body.miniAppUrl !== "string" || body.miniAppUrl.length > 2048) {
        return c.json({ success: false, message: "miniAppUrl must be a string of at most 2048 characters" }, 400);
    }

    if (body.miniAppUrl) {
        try {
            const url = new URL(body.miniAppUrl);
            if (url.protocol !== "https:" && url.protocol !== "http:") {
                return c.json({ success: false, message: "miniAppUrl must use HTTP or HTTPS" }, 400);
            }
        } catch {
            return c.json({ success: false, message: "miniAppUrl must be a valid URL" }, 400);
        }
    }

    const current = await c.env.KV.get<TelegramSettings>(CONSTANTS.TG_KV_SETTINGS_KEY, "json")
        || new TelegramSettings(false, [], "", false, []);
    const updated = { ...current, miniAppUrl: body.miniAppUrl };
    await c.env.KV.put(CONSTANTS.TG_KV_SETTINGS_KEY, JSON.stringify(updated));
    return c.json({ success: true, miniAppUrl: updated.miniAppUrl });
}

export default {
    getTelegramSettings,
    saveTelegramSettings,
    updateTelegramMiniAppUrl,
}
