package com.zga.dualnback;

import android.os.Bundle;

import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        ViewCompat.setOnApplyWindowInsetsListener(
            getBridge().getWebView(),
            (view, windowInsets) -> windowInsets
        );
        ViewCompat.requestApplyInsets(getBridge().getWebView());

        WindowInsetsControllerCompat insetsController = WindowCompat.getInsetsController(
            getWindow(),
            getWindow().getDecorView()
        );
        insetsController.setAppearanceLightStatusBars(true);
        insetsController.setAppearanceLightNavigationBars(true);
    }
}
