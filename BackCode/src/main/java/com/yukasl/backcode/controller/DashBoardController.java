package com.yukasl.backcode.controller;

import com.yukasl.backcode.pojo.VO.DashBoardVO;
import com.yukasl.backcode.result.Result;
import com.yukasl.backcode.service.DashBoardService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Slf4j
@RequestMapping("/api/dashboard")
/**
 * 1.4 仪表盘聚合 (Dashboard)
 */
public class DashBoardController {

    @Autowired
    private DashBoardService dashBoardService;

    /**
     * 获取仪表盘摘要
     *
     */
    @GetMapping("/summary")
    public Result summary(){
        log.info("获取仪表盘摘要");
        DashBoardVO dashBoardVO = dashBoardService.getInfo();
        return Result.success(dashBoardVO);
    }

}
