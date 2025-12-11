package org.example;

import com.alibaba.fastjson.JSON;
import org.hyperledger.fabric.contract.annotation.DataType;
import org.hyperledger.fabric.contract.annotation.Property;

@DataType
public class Evidence {
    @Property private String eventID;
    @Property private String dataHash;
    @Property private String metadata;
    @Property private long timestamp;
    @Property private String submitter;

    // 必须保留无参构造函数，供反序列化使用
    public Evidence() {}

    public Evidence(String eventID, String dataHash, String metadata, long timestamp, String submitter) {
        this.eventID = eventID;
        this.dataHash = dataHash;
        this.metadata = metadata;
        this.timestamp = timestamp;
        this.submitter = submitter;
    }

    // Getters
    public String getEventID() { return eventID; }
    public String getDataHash() { return dataHash; }
    public String getMetadata() { return metadata; }
    public long getTimestamp() { return timestamp; }
    public String getSubmitter() { return submitter; }

    // ✅✅✅ 新增 Setters (反序列化必须！)
    public void setEventID(String eventID) { this.eventID = eventID; }
    public void setDataHash(String dataHash) { this.dataHash = dataHash; }
    public void setMetadata(String metadata) { this.metadata = metadata; }
    public void setTimestamp(long timestamp) { this.timestamp = timestamp; }
    public void setSubmitter(String submitter) { this.submitter = submitter; }

    @Override
    public String toString() { return JSON.toJSONString(this); }
}