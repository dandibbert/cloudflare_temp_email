import { addressParser } from "postal-mime";

import { CONSTANTS } from "../constants";
import { getSplitStringListValue } from "../utils";
import { isSenderBlockedByRules, normalizeBlockList } from "./sender_block_policy";

export { isSenderBlockedByRules, normalizeBlockList } from "./sender_block_policy";

const parseSenderAddresses = (headers: Headers): string[] => {
    try {
        const fromHeader = headers.get("From") || "";
        return addressParser(fromHeader, { flatten: true })
            .map(sender => sender.address || "")
            .filter(Boolean);
    } catch (error) {
        console.error("Failed to parse sender addresses", error);
        return [];
    }
};

export const isBlocked = async (message: Pick<ForwardableEmailMessage, "from" | "headers">, env: Bindings): Promise<boolean> => {
    const senders = [message.from, ...parseSenderAddresses(message.headers)];
    const envRules = getSplitStringListValue(env.BLACK_LIST);
    if (senders.some(sender => isSenderBlockedByRules(sender, envRules))) {
        return true;
    }
    if (!env.KV) {
        return false;
    }
    const blockList = await env.KV.get<unknown>(CONSTANTS.EMAIL_KV_BLACK_LIST, 'json');
    if (blockList !== null && !Array.isArray(blockList)) {
        throw new Error("Invalid sender block list in KV");
    }
    return senders.some(sender => isSenderBlockedByRules(sender, blockList));
}
