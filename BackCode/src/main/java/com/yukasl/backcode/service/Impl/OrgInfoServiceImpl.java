package com.yukasl.backcode.service.impl;

import java.util.List;
import java.util.Map;

import com.github.pagehelper.PageHelper;
import com.yukasl.backcode.result.PageResult;
import com.yukasl.backcode.utils.RandomUtils;
import org.springframework.stereotype.Service;
import com.yukasl.backcode.pojo.entity.orgInfo;
import com.yukasl.backcode.pojo.DTO.OrgInfoDTO;
import com.yukasl.backcode.mapper.OrgInfoMapper;
import com.yukasl.backcode.service.OrgInfoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.client.RestTemplate;

@Service
public class OrgInfoServiceImpl implements OrgInfoService {
    @Autowired
    private OrgInfoMapper orgInfoMapper;

    @Autowired
    private RestTemplate restTemplate;

    @Override
    public PageResult queryOrgInfo(OrgInfoDTO orgInfoDTO) {
        PageHelper.startPage(orgInfoDTO.getPageNum(), orgInfoDTO.getPageSize());
        List<orgInfo> hostStatusMonitors = orgInfoMapper.queryOrgInfo(orgInfoDTO);
        return new PageResult(hostStatusMonitors.size(), hostStatusMonitors);
    }

    @Override
    public orgInfo insertOrgInfo(OrgInfoDTO orgInfoDTO) {
        orgInfoDTO.setOrgId("ORG-" + RandomUtils.generateRandomString(7));
        orgInfoMapper.insertOrgInfo(orgInfoDTO);
        orgInfo latestOrg = orgInfoMapper.queryLatestOrgInfo();

        // 新增：推送到区块链网关 (存证)
        try {
            // 注意：这里调用的是 backend (8080) 的上链接口
            // 使用 [::1] 确保连接成功
            String url = "http://[::1]:8080/api/chain/org";
            restTemplate.postForObject(url, latestOrg, Map.class);
        } catch (Exception e) {
            // 上链失败不应影响本地存储，记录日志即可
            e.printStackTrace();
        }

        return latestOrg;
    }

    @Override
    public orgInfo updateOrgInfo(String id, OrgInfoDTO orgInfoDTO) {
        orgInfoMapper.updateOrgInfo(id, orgInfoDTO);
        return orgInfoMapper.getById(id);
    }

    @Override
    public void deleteOrgInfo(String id) {
        orgInfoMapper.deleteOrgInfo(id);
    }

    @Override
    public orgInfo queryLatestOrgInfo() {
        return orgInfoMapper.queryLatestOrgInfo();
    }
}