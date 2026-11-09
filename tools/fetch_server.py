import http.server
import socketserver
import urllib.parse
import urllib.request
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PORT = 8878


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        # 本地模拟 Cloudflare Pages 的 /image/ 转发（封面）
        if self.path.startswith("/image/"):
            rest = self.path[len("/image/"):]
            cached = os.path.join(ROOT, "data", "_imgcache", os.path.basename(rest))
            if os.path.isfile(cached):
                with open(cached, "rb") as fh:
                    body = fh.read()
                self.send_response(200)
                self.send_header("Content-Type", "image/webp")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            target = "https://storage.sekai.best/sekai-jp-assets/music/jacket/" + rest
            req = urllib.request.Request(
                target, headers={"Referer": "https://sekai.best/", "User-Agent": "Mozilla/5.0"}
            )
            try:
                with urllib.request.urlopen(req, timeout=30) as r:
                    body = r.read()
                    self.send_response(r.status)
                    self.send_header("Content-Type", r.headers.get("Content-Type", "image/webp"))
                    self.send_header("Content-Length", str(len(body)))
                    self.send_header("Cache-Control", "public, max-age=604800")
                    self.end_headers()
                    self.wfile.write(body)
            except Exception as exc:
                self.send_error(404, f"image {exc}")
            return
        # 本地模拟 Cloudflare Pages 的 /audio/ 转发，方便验证同域音频方案
        if self.path.startswith("/audio/"):
            rest = self.path[len("/audio/"):]
            target = "https://storage.sekai.best/sekai-jp-assets/music/short/" + rest
            headers = {"Referer": "https://sekai.best/", "User-Agent": "Mozilla/5.0"}
            rng = self.headers.get("Range")
            if rng:
                headers["Range"] = rng
            req = urllib.request.Request(target, headers=headers)
            try:
                with urllib.request.urlopen(req, timeout=30) as r:
                    body = r.read()
                    self.send_response(r.status)
                    self.send_header("Content-Type", r.headers.get("Content-Type", "audio/mpeg"))
                    self.send_header("Content-Length", str(len(body)))
                    self.send_header("Accept-Ranges", "bytes")
                    self.send_header("Cache-Control", "public, max-age=86400")
                    self.end_headers()
                    self.wfile.write(body)
            except Exception as exc:
                self.send_error(502, f"upstream {exc}")
            return
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path != "/save":
            self.send_error(404)
            return
        qs = urllib.parse.parse_qs(parsed.query)
        name = (qs.get("name") or ["data.bin"])[0]
        safe = os.path.basename(name)
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length)
        out = os.path.join(ROOT, "data", safe)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        with open(out, "wb") as f:
            f.write(body)
        print(f"SAVED {safe} {len(body)} bytes", flush=True)
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write(f"ok {safe} {len(body)}".encode("utf-8"))

    def log_message(self, fmt, *args):
        print(fmt % args, flush=True)


class ThreadingServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True


with ThreadingServer(("127.0.0.1", PORT), Handler) as httpd:
    print(f"serving {ROOT} on http://127.0.0.1:{PORT}", flush=True)
    httpd.serve_forever()
