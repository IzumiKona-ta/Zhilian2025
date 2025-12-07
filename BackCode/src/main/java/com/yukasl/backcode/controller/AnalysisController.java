package com.yukasl.backcode.controller;

import com.yukasl.backcode.pojo.DTO.alertPageDTO;
import com.yukasl.backcode.pojo.DTO.pageTrafficDateDTO;
import com.yukasl.backcode.pojo.entity.potentialThreatAlert;
import com.yukasl.backcode.result.PageResult;
import com.yukasl.backcode.result.Result;
import com.yukasl.backcode.service.AnalysisService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 威胁数据分析预测模块
 */
@RestController
@RequestMapping("/api/analysis")
@Slf4j
public class AnalysisController {
    @Autowired
    private AnalysisService analysisService;

    /**
     * 查询威胁流量统计数据
     */
    @GetMapping("/traffic")
    public Result<PageResult> pageTrafficDate(pageTrafficDateDTO pageTrafficDateDTO) {
        log.info("查询威胁流量统计数据,请求参数为 -> {}", pageTrafficDateDTO);
        PageResult pageResult = analysisService.pageTrafficDate(pageTrafficDateDTO);
        return Result.success(pageResult);

    }

    /**
     * 查询潜在威胁预警列表
     *
     * @param alertPageDTO
     * @return
     */
    @GetMapping("/alert")
    public Result<PageResult> queryAlertPage(alertPageDTO alertPageDTO) {
        log.info("查询潜在威胁预警列表,请求参数为 -> {}", alertPageDTO);
        PageResult pageResult = analysisService.queryAlert(alertPageDTO);
        return Result.success(pageResult);
    }

    /**
     * 查看潜在威胁预警详情
     *
     * @return
     */
    @GetMapping("/alert/{id}")
    public Result<potentialThreatAlert> queryAlertById(@PathVariable Integer id) {
        log.info("查看潜在威胁预警详情,请求参数Id为 -> {}", id);
        potentialThreatAlert threatAlert = analysisService.queryAlertById(id);
        return Result.success(threatAlert);
    }

    /**
     * 接收 IDS 实时告警 (新增)
     */
    @PostMapping("/alert")
    public Result<String> receiveAlert(@RequestBody potentialThreatAlert alert) {
        log.info("接收到 IDS 实时告警: {}", alert);
        analysisService.saveAlert(alert);
        return Result.success("Alert received and processed");
    }
}