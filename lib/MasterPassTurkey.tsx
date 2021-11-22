import React, {Component} from "react";
import WebView, {WebViewMessageEvent} from "react-native-webview";
import {masterPassHTML} from "./masterpass-html";
import {
    CardResult,
    DeleteCardResult,
    MasterPassTurkeyArgs,
    OtpResult,
    OtpType,
    PurchaseArgs,
    PurchaseExistingArgs,
    PurchaseNewArgs,
    PurchaseResult,
    RegistrationCheckResult
} from "./types/common";

export class MasterPassTurkey extends Component<MasterPassTurkeyProps> {
    webView: WebView;
    requests: {[requestId: string]: {resolve: (value) => any, reject: (error) => any}} = {};

    registrationCheck = () => this.execute<RegistrationCheckResult>('return registrationCheck()');
    linkCards = () => this.execute<OtpResult>('return linkCards()');
    listCards = () => this.execute<CardResult>('return listCards()');
    deleteCard = (cardName: string) => this.execute<DeleteCardResult>(`return deleteCard("${cardName}")`);
    resendOtp = () => this.execute<OtpResult>('return resendOtp()');
    verifyOtp = (code: string, type: OtpType) => this.execute<OtpResult>(`return verifyOtp("${code}","${type}")`);
    purchase = (args: PurchaseArgs) => {
        if ((args as PurchaseNewArgs).card)
            return this.execute<PurchaseResult>(`return purchaseWithNewCard(${JSON.stringify(args)})`);
        else if ((args as PurchaseExistingArgs).cardName)
            return this.execute<PurchaseResult>(`return purchaseWithExistingCard(${JSON.stringify(args)})`);
        else
            throw new Error('Card or cardname is required')
    };
    execute = <T extends unknown>(script) => {
        return new Promise<T>((resolve, reject) => {
            const requestId = '_' + Math.round(Math.random() * 10000000000 + 1000000000);
            this.requests[requestId] = {resolve, reject};
            this.webView.injectJavaScript(`(async function () {
                ${script}
                })()
                .then(r => window.ReactNativeWebView.postMessage(JSON.stringify({source: 'RN', requestId: '${requestId}', result: r})))
                .catch(e => window.ReactNativeWebView.postMessage(JSON.stringify({source: 'RN', requestId: '${requestId}', error: e.message})))`);
        })
    }
    onMessage = (event: WebViewMessageEvent) => {
        const parsed = JSON.parse(event.nativeEvent.data);
        if (!parsed.requestId) return this.onEvent(parsed);
        if (parsed.source != "RN") return this.onRequest(parsed.message, parsed.body)
            .then(r => this.webView.injectJavaScript(`(function () {RN.onMessage(${JSON.stringify({
                source: parsed.source,
                requestId: parsed.requestId,
                result: r
            })})})()`))
            .catch(e => this.webView.injectJavaScript(`(function () {RN.onMessage(${JSON.stringify({
                source: parsed.source,
                requestId: parsed.requestId,
                error: e.message
            })})})()`));
        const request = this.requests[parsed.requestId];
        if (!request) return;
        delete this.requests[parsed.requestId];

        if (parsed.error) request.reject(new Error(parsed.error));
        else request.resolve(parsed.result);
    };
    onEvent = (data) => {
        this.props.onEvent?.call(this, data);
    }
    onRequest = async (message, body) => {
        if (this.props.onRequest)
            return await this.props.onRequest(message, body);
        return null;
    }

    render() {
        return (
            <WebView source={{html: masterPassHTML(this.props)}}
                     androidHardwareAccelerationDisabled={true} // required to fix: https://github.com/react-native-webview/react-native-webview/issues/430
                     ref={c => this.webView = c}
                     onMessage={this.onMessage} />
        )
    }
}

export interface MasterPassTurkeyProps extends MasterPassTurkeyArgs {
    onEvent?: (data) => any;
    onRequest?: (message, body) => any;
}
