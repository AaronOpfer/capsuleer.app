vcl 4.0;
import std;

backend default {
 .host = "127.127.127.127";
 .port = "12721";
 /* No active health probe: it can't see through ESI's own edge caching
  * (stale-if-error=900s on /status/) during the brief blips we actually
  * care about, so health is entirely driven by the cron job that marks
  * the backend sick/auto around daily downtime. */
}

sub vcl_recv {
    /* from https://github.com/varnishcache/varnish-cache/blob/master/bin/varnishd/builtin.vcl with some modifications */
    if (req.method == "PRI") {
        /* This will never happen in properly formed traffic (see: RFC7540) */
        return (synth(405));
    }
    if (!req.http.host &&
      req.esi_level == 0 &&
      req.proto ~ "^(?i)HTTP/1.1") {
        /* In HTTP/1.1, Host is required. */
        return (synth(400));
    }
    if (req.method != "GET" &&
      req.method != "HEAD" &&
      req.method != "PUT" &&
      req.method != "POST" &&
      req.method != "TRACE" &&
      req.method != "OPTIONS" &&
      req.method != "DELETE" &&
      req.method != "PATCH") {
        /* Non-RFC2616 or CONNECT which is weird. */
        return (pipe);
    }

    if (req.method != "GET" && req.method != "HEAD") {
        /* We only deal with GET and HEAD by default */
        return (pass);
    }
    if (req.url ~ "^/verify") {
        return (pass);
    }
    return (hash);
}

sub vcl_hash {
    /* per-character cache key (backend is always esi.evetech.net) */
    hash_data(req.url);
    hash_data(req.http.X-Character);
    return (lookup);
}

sub vcl_hit {
    /* stale-if-error, gated on backend health */
    if (obj.ttl >= 0s) {
        return (deliver);
    }
    /* ttl < 0: expired but in grace */
    if (std.healthy(req.backend_hint)) {
        /* healthy: prefer a fresh fetch over the stale object */
        return (pass);
    }
    /* serve stale if backend is unhealthy */
    return (deliver);
}

sub vcl_backend_response {
    if (bereq.uncacheable) {
        return (deliver);
    }
    if (beresp.status >= 400) {
        if (bereq.is_bgfetch) {
            /* discard a failed background refresh during an outage (see vcl_hit) */
            return (abandon);
        }
        /* don't cache the error */
        set beresp.ttl = 0s;
        set beresp.uncacheable = true;
        return (deliver);
    }
    set beresp.grace = 1h; /* vcl_hit's stale window */
    set beresp.keep = 1d; /* keep bodies so we can get 304s from the backend */
    return (deliver);
}
