import { Context } from "hono";

import { normalizeAddressDomain } from "../utils";
import { sendMailToTelegram } from "../telegram_api";
import { auto_reply } from "./auto_reply";
import { isBlocked } from "./black_list";
import { triggerWebhook, triggerAnotherWorker, commonParseMail } from "../common";
import { check_if_junk_mail } from "./check_junk";
import { remove_attachment_if_need } from "./check_attachment";
import { extractEmailInfo } from "./ai_extract";
import { forwardEmail } from "./forward";
import { storeRawMail } from "./storage";
import { findBlockedContentKeyword } from "./content_block";
import { getEmailRuleSettingsForReceive } from "./rule_settings";
import type { EmailRuleSettings } from "../models";


async function email(message: ForwardableEmailMessage, env: Bindings, ctx: ExecutionContext) {
    const toAddress = normalizeAddressDomain(message.to);
    try {
        if (await isBlocked(message.from, env)) {
            message.setReject("Sender blocked");
            console.log(JSON.stringify({ event: "mail_rejected", rule: "sender", to: toAddress }));
            return;
        }
    } catch (error) {
        message.setReject("Sender check failed");
        console.error("sender block check error", error);
        return;
    }

    let emailRuleSettings: EmailRuleSettings;
    try {
        emailRuleSettings = await getEmailRuleSettingsForReceive(env);
    } catch (error) {
        message.setReject("Mail rule check failed");
        console.error("load email rule settings error", error);
        return;
    }

    // Reject unknown recipients before reading and parsing the complete MIME message.
    if (emailRuleSettings.blockReceiveUnknowAddressEmail) {
        try {
            const addressId = await env.DB.prepare(
                "SELECT id FROM address WHERE name = ?"
            ).bind(toAddress).first("id");
            if (!addressId) {
                message.setReject("Unknown address");
                console.log(JSON.stringify({ event: "mail_rejected", rule: "unknown_address", to: toAddress }));
                return;
            }
        } catch (error) {
            message.setReject("Address check failed");
            console.error("check unknown address mail error", error);
            return;
        }
    }

    let rawEmail: string;
    try {
        rawEmail = await new Response(message.raw).text();
    } catch (error) {
        message.setReject("Mail read failed");
        console.error("read raw mail error", error);
        return;
    }
    const parsedEmailContext: ParsedEmailContext = {
        rawEmail: rawEmail
    };

    // check if junk mail
    try {
        const is_junk = await check_if_junk_mail(env, toAddress, parsedEmailContext, message.headers.get("Message-ID"));
        if (is_junk) {
            message.setReject("Junk mail");
            console.log(JSON.stringify({ event: "mail_rejected", rule: "authentication", to: toAddress }));
            return;
        }
    } catch (error) {
        message.setReject("Junk mail check failed");
        console.error("check junk mail error", error);
        return;
    }

    if ((emailRuleSettings.contentBlockList?.length || 0) > 0) {
        try {
            const parsedEmail = await commonParseMail(parsedEmailContext);
            if (!parsedEmail) throw new Error("Unable to parse mail for content block check");
            const matchedKeyword = findBlockedContentKeyword(parsedEmail, emailRuleSettings.contentBlockList);
            if (matchedKeyword) {
                message.setReject("Blocked mail content");
                console.log(JSON.stringify({ event: "mail_rejected", rule: "content", to: toAddress }));
                return;
            }
        } catch (error) {
            message.setReject("Content check failed");
            console.error("check blocked mail content error", error);
            return;
        }
    }

    // remove attachment if configured or size > 2MB
    try {
        await remove_attachment_if_need(env, parsedEmailContext, message.from, toAddress, message.rawSize);
    } catch (error) {
        console.error("remove attachment error", error);
    }

    const message_id = message.headers.get("Message-ID");
    let storedMailId: number | undefined;
    try {
        const { success, meta } = await storeRawMail(
            env, message.from, toAddress, message_id, parsedEmailContext.rawEmail
        );
        if (!success) {
            message.setReject(`Failed save message to ${toAddress}`);
            console.error(`Failed save message from ${message.from} to ${toAddress}`);
            return;
        }
        storedMailId = meta.last_row_id;
    } catch (error) {
        message.setReject(`Failed save message to ${toAddress}`);
        console.error("save email error", error);
        return;
    }

    // forward email
    await forwardEmail(message, env);

    // AI email content extraction
    const aiExtractResult = await extractEmailInfo(parsedEmailContext, env, message_id, toAddress);

    // send email to telegram
    try {
        await sendMailToTelegram(
            { env: env } as Context<HonoCustomType>,
            toAddress, parsedEmailContext, message_id, aiExtractResult);
    } catch (error) {
        console.error("send mail to telegram error", error);
    }

    // send webhook
    try {
        await triggerWebhook(
            { env: env } as Context<HonoCustomType>,
            toAddress, parsedEmailContext, storedMailId, aiExtractResult
        );
    } catch (error) {
        console.error("send webhook error", error);
    }

    // trigger another worker
    try {
        const parsedEmail = (await commonParseMail(parsedEmailContext));
        const parsedText = parsedEmail?.text ?? ""
        const rpcEmail: RPCEmailMessage = {
            from: message.from,
            to: toAddress,
            rawEmail: rawEmail,
            headers: message.headers
        }
        await triggerAnotherWorker({ env: env } as Context<HonoCustomType>, rpcEmail, parsedText);
    } catch (error) {
        console.error("trigger another worker error", error);
    }

    // auto reply email
    await auto_reply(message, env, toAddress);
}

export { email }
