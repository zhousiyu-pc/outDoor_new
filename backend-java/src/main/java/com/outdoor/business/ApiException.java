package com.outdoor.business;

public final class ApiException extends RuntimeException {
    final int status;
    final String code;
    final boolean retryable;
    public ApiException(int status, String code, String message) { this(status, code, message, false); }
    public ApiException(int status, String code, String message, boolean retryable) {
        super(message); this.status = status; this.code = code; this.retryable = retryable;
    }
    static ApiException invalid(String message) { return new ApiException(400, "INVALID_REQUEST", message); }
}
