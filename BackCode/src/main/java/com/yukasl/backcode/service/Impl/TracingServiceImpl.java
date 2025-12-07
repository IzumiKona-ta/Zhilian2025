package com.yukasl.backcode.service.Impl;

import com.github.pagehelper.Page;
import com.github.pagehelper.PageHelper;
import com.yukasl.backcode.mapper.TracingMapper;
import com.yukasl.backcode.pojo.DTO.tracingPageDTO;
import com.yukasl.backcode.pojo.entity.threatSourceTracing;
import com.yukasl.backcode.result.PageResult;
import com.yukasl.backcode.service.TracingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;

@Service
public class TracingServiceImpl implements TracingService {

    @Autowired
    private TracingMapper tracingMapper;
    @Autowired
    private RestTemplate restTemplate;

    /**
     * 查询威胁溯源结果列表
     * @param tracingPageDTO
     * @return
     */
    @Override
    public PageResult page(tracingPageDTO tracingPageDTO) {
        if (tracingPageDTO == null){
            throw new RuntimeException("查询威胁溯源结果列表,请求参数为空");
        }
        PageHelper.startPage(tracingPageDTO.getPageNum(),tracingPageDTO.getPageSize());

        List<threatSourceTracing> list =  tracingMapper.query(tracingPageDTO);

        Page<threatSourceTracing> p = (Page<threatSourceTracing>) list;
        return new PageResult(p.getTotal(),p.getResult());
    }

    @Override
    public threatSourceTracing queryTracingById(Integer id) {
        if (id == null) {
            throw new RuntimeException("查看威胁溯源详情的Id为空");
        }
        threatSourceTracing sourceTracing =  tracingMapper.queryById(id);
        return sourceTracing;
    }

    public void saveTracing(threatSourceTracing sourceTracing) {
        tracingMapper.insert(sourceTracing);
        restTemplate.postForObject("http://localhost:8080/api/chain/trace", sourceTracing, String.class);
    }
}
