package com.yukasl.backcode.controller;

import com.yukasl.backcode.pojo.DTO.HostMonitorDTO;
import com.yukasl.backcode.pojo.DTO.ProcessMonitorDTO;
import com.yukasl.backcode.pojo.entity.hostStatusMonitor;
import com.yukasl.backcode.result.PageResult;
import com.yukasl.backcode.result.Result;
import com.yukasl.backcode.service.MonitorService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@Slf4j
public class MonitorController {
    @Autowired
    private MonitorService monitorService;

    @GetMapping("/api/host/monitor")
    public Result<PageResult> queryHostMonitor(HostMonitorDTO hostMonitorDTO) {
        log.info("查询主机状态监控列表，请求参数为 -> {}", hostMonitorDTO);
        if (hostMonitorDTO.getMonitorTimeStart() != null && hostMonitorDTO.getMonitorTimeEnd() != null && hostMonitorDTO.getMonitorTimeStart().isAfter(hostMonitorDTO.getMonitorTimeEnd()))
            return Result.error("monitorTimeStart晚于monitorTimeEnd");
        return Result.success(monitorService.queryHostMonitor(hostMonitorDTO));
    }

    @GetMapping("/api/host/monitor/realtime/{hostId}")
    public Result<hostStatusMonitor> queryHostMonitorByHostId(@PathVariable String hostId) {
        log.info("查询主机实时状态，请求参数为 -> {}", hostId);
        hostStatusMonitor hostStatusMonitor = monitorService.queryHostMonitorByHostId(hostId);
        if (hostStatusMonitor == null)
            return Result.error("hostId not found");
        return Result.success(hostStatusMonitor);
    }

    @GetMapping("/api/process/monitor")
    public Result<PageResult> queryProcessMonitor(ProcessMonitorDTO processMonitorDTO) {
        log.info("查询系统进程监控列表，请求参数为 -> {}", processMonitorDTO);
        return Result.success(monitorService.queryProcessMonitor(processMonitorDTO));
    }

    @PutMapping("/api/process/monitor/{id}")
    public Result<Object> updateProcessMonitor(@PathVariable String id, @RequestBody ProcessMonitorDTO processMonitorDTO) {
        log.info("处理异常进程，请求id -> {}，请求参数为 -> {}", id, processMonitorDTO);
        monitorService.updateProcessMonitor(id, processMonitorDTO);
        return Result.success();
    }
}