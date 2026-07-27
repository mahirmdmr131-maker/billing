package com.amfood.manager;

import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.Toast;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        WebView webView = this.getBridge().getWebView();
        if (webView != null) {
            WebSettings settings = webView.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setAllowFileAccess(true);
            settings.setAllowContentAccess(true);
            settings.setJavaScriptCanOpenWindowsAutomatically(true);
            settings.setSupportMultipleWindows(true);
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

            // Add JavaScript interface for native printing & sharing
            webView.addJavascriptInterface(new WebAppInterface(this, webView), "AndroidBridge");

            // Handle popups (Google Drive OAuth dialogue, external windows)
            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, android.os.Message resultMsg) {
                    WebView newWebView = new WebView(MainActivity.this);
                    WebSettings newSettings = newWebView.getSettings();
                    newSettings.setJavaScriptEnabled(true);
                    newSettings.setDomStorageEnabled(true);
                    newSettings.setJavaScriptCanOpenWindowsAutomatically(true);

                    newWebView.setWebViewClient(new WebViewClient() {
                        @Override
                        public boolean shouldOverrideUrlLoading(WebView view, String url) {
                            if (url.contains("accounts.google.com") || url.contains("oauth")) {
                                webView.loadUrl(url); // Redirect directly in main webview
                                return true;
                            }
                            return false;
                        }
                    });

                    WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                    transport.setWebView(newWebView);
                    resultMsg.sendToTarget();
                    return true;
                }
            });

            // Handle file downloads across Android
            webView.setDownloadListener(new DownloadListener() {
                @Override
                public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW);
                        intent.setData(Uri.parse(url));
                        startActivity(intent);
                    } catch (Exception e) {
                        try {
                            Intent shareIntent = new Intent(Intent.ACTION_SEND);
                            shareIntent.setType(mimetype != null ? mimetype : "*/*");
                            shareIntent.putExtra(Intent.EXTRA_TEXT, url);
                            startActivity(Intent.createChooser(shareIntent, "Save or Share File"));
                        } catch (Exception ex) {
                            Toast.makeText(MainActivity.this, "File download started", Toast.LENGTH_SHORT).show();
                        }
                    }
                }
            });
        }
    }

    public class WebAppInterface {
        Context mContext;
        WebView mWebView;

        WebAppInterface(Context c, WebView w) {
            mContext = c;
            mWebView = w;
        }

        @JavascriptInterface
        public void printDocument(String jobName) {
            runOnUiThread(() -> {
                try {
                    PrintManager printManager = (PrintManager) mContext.getSystemService(Context.PRINT_SERVICE);
                    PrintDocumentAdapter printAdapter = mWebView.createPrintDocumentAdapter(jobName != null ? jobName : "AM Manager Document");
                    printManager.print(jobName != null ? jobName : "AM Manager Print Job", printAdapter, new PrintAttributes.Builder().build());
                } catch (Exception e) {
                    Toast.makeText(mContext, "Print error: " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            });
        }

        @JavascriptInterface
        public void shareText(String title, String text) {
            runOnUiThread(() -> {
                try {
                    Intent sendIntent = new Intent();
                    sendIntent.setAction(Intent.ACTION_SEND);
                    sendIntent.putExtra(Intent.EXTRA_TEXT, text);
                    sendIntent.setType("text/plain");
                    Intent shareIntent = Intent.createChooser(sendIntent, title);
                    mContext.startActivity(shareIntent);
                } catch (Exception e) {
                    Toast.makeText(mContext, "Share error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                }
            });
        }
    }
}
