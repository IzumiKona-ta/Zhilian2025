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

    public Evidence() {}

    public Evidence(String eventID, String dataHash, String metadata, long timestamp, String submitter) {
        this.eventID = eventID;
        this.dataHash = dataHash;
        this.metadata = metadata;
        this.timestamp = timestamp;
        this.submitter = submitter;
    }
    // Getters (Simplified for script brevity, usually required for JSON serialization)
    public String getEventID() { return eventID; }
    public String getDataHash() { return dataHash; }
    public String getMetadata() { return metadata; }
    public long getTimestamp() { return timestamp; }
    public String getSubmitter() { return submitter; }
    
    @Override
    public String toString() { return JSON.toJSONString(this); }
}
