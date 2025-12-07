package com.yukasl.backcode.mapper;

import com.yukasl.backcode.pojo.DTO.HostMonitorDTO;
import com.yukasl.backcode.pojo.DTO.ProcessMonitorDTO;
import com.yukasl.backcode.pojo.entity.hostStatusMonitor;
import com.yukasl.backcode.pojo.entity.processMonitor;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface MonitorMapper {
    List<hostStatusMonitor> queryHostMonitor(HostMonitorDTO hostMonitorDTO);

    @Select("select * from host_status_monitor where host_id = #{hostId}")
    hostStatusMonitor queryHostMonitorByHostId(String hostId);

    List<processMonitor> queryProcessMonitor(ProcessMonitorDTO hostMonitorDTO);

    void updateProcessMonitor(String id, ProcessMonitorDTO processMonitorDTO);
}