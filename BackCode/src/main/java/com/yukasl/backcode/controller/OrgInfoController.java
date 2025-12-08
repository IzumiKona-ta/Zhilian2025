package com.yukasl.backcode.controller;

import com.yukasl.backcode.pojo.DTO.OrgInfoDTO;
import com.yukasl.backcode.pojo.entity.orgInfo;
import com.yukasl.backcode.result.PageResult;
import com.yukasl.backcode.result.Result;
import com.yukasl.backcode.service.OrgInfoService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@Slf4j
public class OrgInfoController {
    @Autowired
    private OrgInfoService orgInfoService;

    @GetMapping("/api/org/info")
    public Result<PageResult> queryOrgInfo(OrgInfoDTO orgInfoDTO) {
        log.info("查询组织信息列表，请求参数为 -> {}", orgInfoDTO);
        return Result.success(orgInfoService.queryOrgInfo(orgInfoDTO));
    }

    @PostMapping("/api/org/info")
    public Result<orgInfo> insertOrgInfo(@RequestBody OrgInfoDTO orgInfoDTO) {
        log.info("新增组织信息，请求参数为 -> {}", orgInfoDTO);
        if (orgInfoDTO.getOrgName() == null || orgInfoDTO.getOrgName().isEmpty())
            return Result.error("orgName is empty");
        return Result.success(orgInfoService.insertOrgInfo(orgInfoDTO));
    }

    @PutMapping("/api/org/info/{id}")
    public Result<orgInfo> updateOrgInfo(@PathVariable String id, @RequestBody OrgInfoDTO orgInfoDTO) {
        log.info("修改组织权限，请求id -> {}，请求参数为 -> {}", id, orgInfoDTO);
        return Result.success(orgInfoService.updateOrgInfo(id, orgInfoDTO));
    }

    @DeleteMapping("/api/org/info/{id}")
    public Result<Object> deleteOrgInfo(@PathVariable String id) {
        log.info("删除组织，请求id -> {}", id);
        orgInfoService.deleteOrgInfo(id);
        return Result.success();
    }
}