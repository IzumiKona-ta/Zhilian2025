package com.yukasl.backcode.controller;

import com.yukasl.backcode.pojo.DTO.tracingPageDTO;
import com.yukasl.backcode.pojo.entity.threatSourceTracing;
import com.yukasl.backcode.result.PageResult;
import com.yukasl.backcode.result.Result;
import com.yukasl.backcode.service.TracingService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tracing/result")
@Slf4j
public class TracingController {
    @Autowired
    private TracingService tracingService;

    /**
     * 查询威胁溯源结果列表
     */
    @GetMapping
    public Result<PageResult> tracingPage(tracingPageDTO tracingPageDTO) {
        log.info("查询威胁溯源结果列表,请求参数为 -> {}", tracingPageDTO);
        PageResult pageResult = tracingService.page(tracingPageDTO);
        return Result.success(pageResult);
    }

    /**
     * 查看威胁溯源详情（含流程图）
     */
    @GetMapping("/{id}")
    public Result<threatSourceTracing> queryTracingById(@PathVariable Integer id) {
        log.info("查看威胁溯源详细,Id为 -> {}", id);
        threatSourceTracing sourceTracing = tracingService.queryTracingById(id);
        return Result.success(sourceTracing);
    }
}