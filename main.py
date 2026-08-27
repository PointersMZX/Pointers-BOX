import webview
import os
import sys

def get_resource_path(relative_path):
    if getattr(sys, 'frozen', False):
        base_path = os.path.dirname(sys.executable)
    else:
        base_path = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_path, relative_path)

if __name__ == '__main__':
    html_path = get_resource_path('index.html')
    
    window = webview.create_window(
        title='Pointers-BOX',
        url=html_path,
        width=1280,
        height=720,
        resizable=True,
        min_size=(800, 600)
    )
    
    webview.start(icon='app.ico')