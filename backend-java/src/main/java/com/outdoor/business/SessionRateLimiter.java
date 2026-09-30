package com.outdoor.business;

import org.springframework.stereotype.Component;
import java.time.Clock;
import java.util.HashMap;
import java.util.Map;

/** Local abuse bound only. Production identity / distributed rate limiting remains a deployment gate. */
@Component
public class SessionRateLimiter {
    private record Window(long started,int requests) {}
    private final Map<String,Window> windows=new HashMap<>();
    private final Clock clock;
    public SessionRateLimiter(Clock clock) { this.clock=clock; }
    public synchronized void check(String session) {
        long now=clock.millis();
        windows.entrySet().removeIf(e -> now-e.getValue().started()>=60000);
        Window old=windows.get(session);
        if ((old!=null && old.requests()>=120) || (old==null && windows.size()>=4096)) throw new ApiException(429,"RATE_LIMITED","请求较多，请稍后重试。",true);
        windows.put(session,new Window(old==null?now:old.started(),old==null?1:old.requests()+1));
    }
}
