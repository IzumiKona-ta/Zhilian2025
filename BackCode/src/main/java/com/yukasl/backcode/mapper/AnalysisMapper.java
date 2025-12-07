package com.yukasl.backcode.mapper;

import com.yukasl.backcode.pojo.DTO.alertPageDTO;
import com.yukasl.backcode.pojo.DTO.pageTrafficDateDTO;
import com.yukasl.backcode.pojo.entity.potentialThreatAlert;
import com.yukasl.backcode.pojo.entity.threatTrafficStat;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface AnalysisMapper {

    /**
     * 新增潜在威胁预警
     */
    @Insert("insert into potential_threat_alert (threat_id, threat_level, impact_scope, occur_time, create_time) values (#{threatId}, #{threatLevel}, #{impactScope}, #{occurTime}, #{createTime})")
    @Options(useGeneratedKeys = true, keyProperty = "id")
    void insert(potentialThreatAlert alert);

    /**
     * 查询威胁流量统计数据
     *
     * @param pageTrafficDateDTO
     * @return
     */
    List<threatTrafficStat> page(pageTrafficDateDTO pageTrafficDateDTO);

    /**
     * 查询潜在威胁预警列表
     *
     * @param alertPageDTO
     * @return
     */
    List<potentialThreatAlert> queryAlertPage(alertPageDTO alertPageDTO);

    /**
     * 查看潜在威胁预警详情
     *
     * @param id
     * @return
     */
    @Select("select id, threat_id, threat_level, impact_scope, occur_time, create_time from potential_threat_alert where id = #{id}")
    potentialThreatAlert queryAlertById(Integer id);
}