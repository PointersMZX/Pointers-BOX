package cc.pointers.box;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(InAppBrowserPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
