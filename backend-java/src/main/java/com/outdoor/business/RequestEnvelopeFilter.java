package com.outdoor.business;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.ByteArrayInputStream;
import java.io.IOException;

/** Bound JSON bytes before deserialization, including requests without Content-Length. */
@Component
public class RequestEnvelopeFilter extends OncePerRequestFilter {
    private final JsonSupport json;
    public RequestEnvelopeFilter(JsonSupport json) { this.json=json; }
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain) throws ServletException,IOException {
        String correlation=json.id("corr"),requestId=json.id("req");
        request.setAttribute("correlationId",correlation); request.setAttribute("requestId",requestId);
        response.setHeader("X-Correlation-Id",correlation);
        if (!"POST".equals(request.getMethod())) { chain.doFilter(request,response);return; }
        byte[] bytes=request.getInputStream().readNBytes(65537);
        if (bytes.length>65536) {
            response.setStatus(413);response.setContentType("application/json;charset=UTF-8");
            var body=json.object().put("ok",false).put("requestId",requestId).put("correlationId",correlation);
            body.putObject("error").put("code","INVALID_REQUEST").put("message","请求内容过大。").put("retryable",false);
            response.getWriter().write(body.toString());return;
        }
        chain.doFilter(new HttpServletRequestWrapper(request) {
            @Override public ServletInputStream getInputStream() {
                ByteArrayInputStream stream=new ByteArrayInputStream(bytes);
                return new ServletInputStream() {
                    @Override public int read() { return stream.read(); }
                    @Override public int read(byte[] b,int off,int len) { return stream.read(b,off,len); }
                    @Override public boolean isFinished() { return stream.available()==0; }
                    @Override public boolean isReady() { return true; }
                    @Override public void setReadListener(ReadListener listener) { throw new UnsupportedOperationException("Synchronous JSON endpoint"); }
                };
            }
        },response);
    }
}
