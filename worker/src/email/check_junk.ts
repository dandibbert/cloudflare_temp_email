import { getBooleanValue, getStringArray } from "../utils";
import { commonParseMail } from "../common";
import { isJunkMailByHeaders } from "./junk_mail_policy";

export const check_if_junk_mail = async (
    env: Bindings, address: string,
    parsedEmailContext: ParsedEmailContext,
    message_id: string | null
): Promise<boolean> => {
    if (!getBooleanValue(env.ENABLE_CHECK_JUNK_MAIL)) {
        return false;
    }
    const parsedEmail = await commonParseMail(parsedEmailContext);
    if (!parsedEmail?.headers) {
        throw new Error("Unable to parse headers for junk mail check");
    }

    const checkListWhenExist = getStringArray(env.JUNK_MAIL_CHECK_LIST);
    const forcePassList = getStringArray(env.JUNK_MAIL_FORCE_PASS_LIST);
    const trustedAuthservIds = getStringArray(env.JUNK_MAIL_TRUSTED_AUTHSERV_IDS);
    return isJunkMailByHeaders(
        parsedEmail.headers,
        checkListWhenExist,
        forcePassList,
        trustedAuthservIds.length > 0 ? trustedAuthservIds : undefined,
    );
}
