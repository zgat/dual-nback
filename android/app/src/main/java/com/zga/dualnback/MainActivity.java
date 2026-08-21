package com.zga.dualnback;

import android.os.Bundle;
import android.view.View;

import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        View appRoot = (View) getBridge().getWebView().getParent();
        appRoot.setBackgroundColor(ContextCompat.getColor(this, R.color.app_paper));
        ViewCompat.setOnApplyWindowInsetsListener(
            appRoot,
            (view, windowInsets) -> {
                Insets safeInsets = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars()
                        | WindowInsetsCompat.Type.displayCutout()
                );
                view.setPadding(
                    safeInsets.left,
                    safeInsets.top,
                    safeInsets.right,
                    safeInsets.bottom
                );
                return windowInsets;
            }
        );
        ViewCompat.requestApplyInsets(appRoot);

        WindowInsetsControllerCompat insetsController = WindowCompat.getInsetsController(
            getWindow(),
            getWindow().getDecorView()
        );
        insetsController.setAppearanceLightStatusBars(true);
        insetsController.setAppearanceLightNavigationBars(true);
    }
}
