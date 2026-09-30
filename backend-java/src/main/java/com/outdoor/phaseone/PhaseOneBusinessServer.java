package com.outdoor.phaseone;

/** Compatibility entry point. The JSONL and fabricated fallback implementation is retired. */
@Deprecated
public final class PhaseOneBusinessServer {
    private PhaseOneBusinessServer() {}
    public static void main(String[] args) { com.outdoor.business.BusinessApplication.main(args); }
}
