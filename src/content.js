// content.js — runs in MAIN world at document_start.
// Strategy: return fake "404 Not Found" for all extension probes.
// A clean 404 tells the prober "extension not installed" → stops retrying.
// Rejecting with TypeError was causing retry loops (the original problem).

(function () {
  function isEnabled() {
    return document.documentElement.dataset.probeBlocker !== "disabled";
  }

  function isExtensionProbe(arg) {
    try {
      if (!arg) return false;
      let url = arg instanceof Request ? arg.url
              : arg instanceof URL     ? arg.href
              : typeof arg === "string" ? arg : "";
      return url.startsWith("chrome-extension://");
    } catch (e) { return false; }
  }

  // --- Patch fetch ---
  const origFetch = window.fetch;
  window.fetch = function (...args) {
    if (isEnabled() && isExtensionProbe(args[0])) {
      // Return a fake 404 — prober sees "not found", stops retrying
      return Promise.resolve(new Response(null, { status: 404, statusText: "Not Found" }));
    }
    return origFetch.apply(this, args);
  };
  Object.defineProperty(window, "fetch", { value: window.fetch, writable: false, configurable: false });

  // --- Patch XMLHttpRequest ---
  const OrigXHR = window.XMLHttpRequest;
  function PatchedXHR() {
    const xhr = new OrigXHR();
    let _isProbe = false;

    const origOpen = xhr.open.bind(xhr);
    xhr.open = function (method, url, ...rest) {
      _isProbe = isEnabled() && typeof url === "string" && url.startsWith("chrome-extension://");
      if (_isProbe) return;
      return origOpen(method, url, ...rest);
    };

    const origSend = xhr.send.bind(xhr);
    xhr.send = function (...args) {
      if (_isProbe) {
        setTimeout(() => {
          Object.defineProperty(xhr, "readyState",  { get: () => 4,           configurable: true });
          Object.defineProperty(xhr, "status",      { get: () => 404,         configurable: true });
          Object.defineProperty(xhr, "statusText",  { get: () => "Not Found", configurable: true });
          Object.defineProperty(xhr, "responseText",{ get: () => "",          configurable: true });
          Object.defineProperty(xhr, "response",    { get: () => "",          configurable: true });
          ["readystatechange", "load", "loadend"].forEach(type => {
            try { xhr.dispatchEvent(new Event(type)); } catch (_) {}
          });
          if (typeof xhr.onreadystatechange === "function") try { xhr.onreadystatechange(); } catch (_) {}
          if (typeof xhr.onload === "function") try { xhr.onload(); } catch (_) {}
          if (typeof xhr.onloadend === "function") try { xhr.onloadend(); } catch (_) {}
        }, 0);
        return;
      }
      return origSend(...args);
    };

    return xhr;
  }
  Object.setPrototypeOf(PatchedXHR, OrigXHR);
  PatchedXHR.prototype = OrigXHR.prototype;
  Object.defineProperty(window, "XMLHttpRequest", { value: PatchedXHR, writable: false, configurable: false });

  // --- Patch Image src probing ---
  const OrigImage = window.Image;
  function PatchedImage(...args) {
    const img = new OrigImage(...args);
    const origDescriptor = Object.getOwnPropertyDescriptor(OrigImage.prototype, "src");
    Object.defineProperty(img, "src", {
      set(val) {
        if (isEnabled() && typeof val === "string" && val.startsWith("chrome-extension://")) {
          setTimeout(() => {
            if (typeof img.onerror === "function") try { img.onerror(new Event("error")); } catch (_) {}
            img.dispatchEvent(new Event("error"));
          }, 0);
          return;
        }
        origDescriptor.set.call(img, val);
      },
      get() { return origDescriptor.get.call(img); },
      configurable: true,
    });
    return img;
  }
  Object.setPrototypeOf(PatchedImage, OrigImage);
  PatchedImage.prototype = OrigImage.prototype;
  Object.defineProperty(window, "Image", { value: PatchedImage, writable: false, configurable: false });

  console.log(
    `%c[ProbeBlocker] ✅ fetch + XHR + Image patched (enabled=${isEnabled()})`,
    "color: #4dff88; font-weight: bold;"
  );
})();

