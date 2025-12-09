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

    @Select("select * from host_status_monitor where host_id = #{hostId} order by monitor_time desc limit 1")
    hostStatusMonitor queryHostMonitorByHostId(String hostId);

    List<processMonitor> queryProcessMonitor(ProcessMonitorDTO hostMonitorDTO);

    void updateProcessMonitor(String id, ProcessMonitorDTO processMonitorDTO);

    @org.apache.ibatis.annotations.Insert("insert into host_status_monitor(host_id, cpu_usage, memory_usage, network_conn, disk_usage, disk_info, file_status, monitor_time, create_time) values(#{hostId}, #{cpuUsage}, #{memoryUsage}, #{networkConn}, #{diskUsage}, #{diskInfo}, #{fileStatus}, #{monitorTime}, #{createTime})")
    void insertHostStatus(hostStatusMonitor status);
}