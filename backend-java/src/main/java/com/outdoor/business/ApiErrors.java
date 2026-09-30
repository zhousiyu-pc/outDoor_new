package com.outdoor.business;

import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class ApiErrors {
    private static final Logger LOG=LoggerFactory.getLogger(ApiErrors.class);
    private final JsonSupport json;
    public ApiErrors(JsonSupport json) { this.json=json; }
    @ExceptionHandler(ApiException.class)
    ResponseEntity<ObjectNode> api(ApiException error,HttpServletRequest request) { return response(error.status,error.code,error.getMessage(),error.retryable,request); }
    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ObjectNode> malformed(Exception error,HttpServletRequest request) { return response(400,"INVALID_REQUEST","请求 JSON 无效。",false,request); }
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<ObjectNode> method(Exception error,HttpServletRequest request) { return response(405,"METHOD_NOT_ALLOWED","该接口不支持此请求方法。",false,request); }
    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    ResponseEntity<ObjectNode> media(Exception error,HttpServletRequest request) { return response(415,"INVALID_REQUEST","请使用 application/json。",false,request); }
    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<ObjectNode> missing(Exception error,HttpServletRequest request) { return response(404,"NOT_FOUND","接口不存在。",false,request); }
    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<ObjectNode> database(Exception error,HttpServletRequest request) {
        LOG.warn("Database operation failed correlationId={} type={}",request.getAttribute("correlationId"),error.getClass().getSimpleName());
        return response(503,"PERSISTENCE_UNAVAILABLE","暂时无法保存，请稍后重试。",true,request);
    }
    @ExceptionHandler(Exception.class)
    ResponseEntity<ObjectNode> unexpected(Exception error,HttpServletRequest request) {
        LOG.error("Request failed correlationId={} type={}",request.getAttribute("correlationId"),error.getClass().getSimpleName());
        return response(500,"INTERNAL_ERROR","服务暂时不可用。",true,request);
    }
    private ResponseEntity<ObjectNode> response(int status,String code,String message,boolean retryable,HttpServletRequest request) {
        ObjectNode body=json.object().put("ok",false).put("requestId",String.valueOf(request.getAttribute("requestId"))).put("correlationId",String.valueOf(request.getAttribute("correlationId")));
        body.putObject("error").put("code",code).put("message",message).put("retryable",retryable);
        return ResponseEntity.status(status).body(body);
    }
}
