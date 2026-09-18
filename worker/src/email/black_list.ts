import { CONSTANTS } from "../constants";
import { getSplitStringListValue } from "../utils";
import { isSenderBlockedByRules, normalizeBlockList } from "./sender_block_policy";

export { isSenderBlockedByRules, normalizeBlockList } from "./sender_block_policy";

export const isBlocked = async (from: string, env: Bindings): Promise<boolean> => {
    if (isSenderBlockedByRules(from, getSplitStringListValue(env.BLACK_LIST))) {
        return true;
    }
    if (!env.KV) {
        return false;
    }
    const blockList = await env.KV.get<unknown>(CONSTANTS.EMAIL_KV_BLACK_LIST, 'json');
    if (blockList !== null && !Array.isArray(blockList)) {
        throw new Error("Invalid sender block list in KV");
    }
    return isSenderBlockedByRules(from, blockList);
}
