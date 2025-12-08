package com.yukasl.backcode.service.impl;

import java.util.List;

import com.github.pagehelper.PageHelper;
import com.yukasl.backcode.result.PageResult;
import com.yukasl.backcode.utils.RandomUtils;
import org.springframework.stereotype.Service;
import com.yukasl.backcode.pojo.entity.orgInfo;
import com.yukasl.backcode.pojo.DTO.OrgInfoDTO;
import com.yukasl.backcode.mapper.OrgInfoMapper;
import com.yukasl.backcode.service.OrgInfoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import org.springframework.web.client.RestTemplate;

@Service
public class OrgInfoServiceImpl implements OrgInfoService {
    @Autowired
    private OrgInfoMapper orgInfoMapper;

    @Override
    public PageResult queryOrgInfo(OrgInfoDTO orgInfoDTO) {
        PageHelper.startPage(orgInfoDTO.getPageNum(), orgInfoDTO.getPageSize());
        List<orgInfo> hostStatusMonitors = orgInfoMapper.queryOrgInfo(orgInfoDTO);
        return new PageResult(hostStatusMonitors.size(), hostStatusMonitors);
    }

    @Override
    public void insertOrgInfo(OrgInfoDTO orgInfoDTO) {
        orgInfoDTO.setOrgId("ORG-" + RandomUtils.generateRandomString(7));
        orgInfoMapper.insertOrgInfo(orgInfoDTO);
    }

    @Override
    public void updateOrgInfo(String id, OrgInfoDTO orgInfoDTO) {
        orgInfoMapper.updateOrgInfo(id, orgInfoDTO);
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