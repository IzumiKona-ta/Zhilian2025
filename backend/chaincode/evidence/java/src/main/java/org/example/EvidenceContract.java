package org.example;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import org.hyperledger.fabric.contract.Context;
import org.hyperledger.fabric.contract.ContractInterface;
import org.hyperledger.fabric.contract.annotation.Contract;
import org.hyperledger.fabric.contract.annotation.Default;
import org.hyperledger.fabric.contract.annotation.Transaction;
import org.hyperledger.fabric.shim.ChaincodeStub;
import org.hyperledger.fabric.contract.ClientIdentity;
import org.hyperledger.fabric.shim.ledger.KeyValue;
import org.hyperledger.fabric.shim.ledger.QueryResultsIterator;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Contract(name = "evidence")
@Default
public class EvidenceContract implements ContractInterface {

    // 允许写入的 MSP ID (Org1)
    private static final String ALLOWED_WRITER_MSP = "Org1MSP";

    @Transaction(intent = Transaction.TYPE.SUBMIT)
    public void initLedger(final Context ctx) {}

    @Transaction(intent = Transaction.TYPE.SUBMIT)
    public String submitEvidence(final Context ctx, String eventID, String dataHash, String metadata) {
        checkWriterPermission(ctx);
        saveEvidence(ctx, eventID, dataHash, metadata);
        return "SUCCESS: " + eventID;
    }

    @Transaction(intent = Transaction.TYPE.SUBMIT)
    public String submitEvidenceBatch(final Context ctx, String batchJson) {
        checkWriterPermission(ctx);
        JSONArray items = JSON.parseArray(batchJson);
        List<String> successIds = new ArrayList<>();

        for (int i = 0; i < items.size(); i++) {
            JSONObject item = items.getJSONObject(i);
            // 确保 DTO 里的字段名和这里一致
            saveEvidence(ctx, item.getString("eventID"), item.getString("dataHash"), item.getString("metadata"));
            successIds.add(item.getString("eventID"));
        }
        return "BATCH SUCCESS: " + successIds.toString();
    }

    // 内部权限检查方法
    private void checkWriterPermission(Context ctx) {
        ClientIdentity client = ctx.getClientIdentity();
        String mspId = client.getMSPID();
        
        if (!ALLOWED_WRITER_MSP.equals(mspId)) {
            throw new RuntimeException("🚫 权限不足！当前用户属于 " + mspId + "，只有 " + ALLOWED_WRITER_MSP + " 有权上链。");
        }
    }

    private void saveEvidence(Context ctx, String eventID, String dataHash, String metadata) {
        ChaincodeStub stub = ctx.getStub();
        String evidenceState = stub.getStringState(eventID);
        if (evidenceState != null && !evidenceState.isEmpty()) {
            throw new RuntimeException("Evidence " + eventID + " already exists");
        }
        
        String submitter = ctx.getClientIdentity().getMSPID();
        // 统一使用 Fastjson 序列化
        Evidence evidence = new Evidence(eventID, dataHash, metadata, Instant.now().getEpochSecond(), submitter);
        stub.putStringState(eventID, JSON.toJSONString(evidence));
    }

    @Transaction(intent = Transaction.TYPE.EVALUATE)
    public String getEvidenceByEventID(final Context ctx, String eventID) {
        ChaincodeStub stub = ctx.getStub();
        String evidenceJSON = stub.getStringState(eventID);
        if (evidenceJSON == null || evidenceJSON.isEmpty()) {
            throw new RuntimeException("Evidence " + eventID + " does not exist");
        }
        return evidenceJSON;
    }

    // 🔥 范围查询 (Range Query) 实现的 "Type 查询"
    // 注意：这要求 Key 必须以 type + "_" 开头，例如 "ORG_1001"
    @Transaction(intent = Transaction.TYPE.EVALUATE)
    public String queryEvidenceByType(final Context ctx, final String type) {
        ChaincodeStub stub = ctx.getStub();
        List<Evidence> queryResults = new ArrayList<>();
        
        // 构造范围查询键
        String startKey = type + "_";
        String endKey = type + "_\uffff";

        QueryResultsIterator<KeyValue> results = stub.getStateByRange(startKey, endKey);

        for (KeyValue result : results) {
            String value = result.getStringValue();
            if (value != null && !value.isEmpty()) {
                // 统一使用 Fastjson 反序列化
                Evidence evidence = JSON.parseObject(value, Evidence.class);
                queryResults.add(evidence);
            }
        }

        return JSON.toJSONString(queryResults);
    }
}