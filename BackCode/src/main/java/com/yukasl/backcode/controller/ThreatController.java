package com.yukasl.backcode.controller;

import com.yukasl.backcode.pojo.entity.potentialThreatAlert;
import com.yukasl.backcode.result.Result;
import com.yukasl.backcode.service.AnalysisService;
import com.yukasl.backcode.service.CommandQueueService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/threats")
@Slf4j
public class ThreatController {

    @Autowired
    private AnalysisService analysisService;

    @Autowired
    private CommandQueueService commandQueueService;

    /**
     * 下发 IP 阻断指令
     * @param id 威胁ID
     */
    @PostMapping("/{id}/block")
    public Result<String> blockIp(@PathVariable Integer id) {
        log.info("收到阻断请求，威胁ID: {}", id);
        
        potentialThreatAlert alert = analysisService.queryAlertById(id);
        if (alert == null) {
            return Result.error("Threat event not found");
        }

        // 解析攻击源 IP 和 受害主机 IP
        // 假设 impactScope 格式: "192.168.1.5:1234 -> 192.168.1.100:80 | SQL Injection"
        String scope = alert.getImpactScope();
        if (scope == null || !scope.contains("->")) {
            return Result.error("Cannot parse IPs from impact scope");
        }

        try {
            String[] parts = scope.split("\\|");
            String flow = parts[0].trim(); // "192.168.1.5:1234 -> 192.168.1.100:80"
            String[] ips = flow.split("->");
            
            String srcIp = ips[0].trim().split(":")[0]; // 攻击者
            String dstIp = ips[1].trim().split(":")[0]; // 受害者 (Host)

            // 生成阻断指令
            // 格式: BLOCK_IP <ip>
            String command = "BLOCK_IP " + srcIp;
            
            // 将指令放入受害主机的队列
            commandQueueService.addCommand(dstIp, command);
            
            log.info("已生成阻断指令 '{}' 给主机 {}", command, dstIp);
            return Result.success("Block command queued for host " + dstIp);

        } catch (Exception e) {
            log.error("解析 IP 失败", e);
            return Result.error("Failed to parse IP addresses");
        }
    }
    
    /**
     * 下发 IP 解封指令
     * @param id 威胁ID
     */
    @PostMapping("/{id}/unblock")
    public Result<String> unblockIp(@PathVariable Integer id) {
        log.info("收到解封请求，威胁ID: {}", id);

        potentialThreatAlert alert = analysisService.queryAlertById(id);
        if (alert == null) {
            return Result.error("Threat event not found");
        }

        String scope = alert.getImpactScope();
        if (scope == null || !scope.contains("->")) {
            return Result.error("Cannot parse IPs from impact scope");
        }

        try {
            String[] parts = scope.split("\\|");
            String flow = parts[0].trim();
            String[] ips = flow.split("->");

            String srcIp = ips[0].trim().split(":")[0];
            String dstIp = ips[1].trim().split(":")[0];

            // 生成解封指令
            String command = "UNBLOCK_IP " + srcIp;

            commandQueueService.addCommand(dstIp, command);

            log.info("已生成解封指令 '{}' 给主机 {}", command, dstIp);
            return Result.success("Unblock command queued for host " + dstIp);

        } catch (Exception e) {
            log.error("解析 IP 失败", e);
            return Result.error("Failed to parse IP addresses");
        }
    }

    /**
     * 标记误报/已解决
     */
    @PostMapping("/{id}/resolve")
    public Result<String> resolveThreat(@PathVariable Integer id) {
        log.info("标记威胁已解决: {}", id);
        // 这里应该调用 service 更新状态，暂时仅返回成功
        return Result.success("Threat marked as resolved");
    }
}
