package com.yukasl.backcode.service;

import com.yukasl.backcode.pojo.DTO.OrgInfoDTO;
import com.yukasl.backcode.pojo.entity.orgInfo;
import com.yukasl.backcode.result.PageResult;

public interface OrgInfoService {
    PageResult queryOrgInfo(OrgInfoDTO orgInfoDTO);

    void insertOrgInfo(OrgInfoDTO orgInfoDTO);

    void updateOrgInfo(String id, OrgInfoDTO orgInfoDTO);

    void deleteOrgInfo(String id);

    orgInfo queryLatestOrgInfo();
}