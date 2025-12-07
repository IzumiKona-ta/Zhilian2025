package com.example.blockchain;

import org.hyperledger.fabric.gateway.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.InvalidKeyException;
import java.security.PrivateKey;
import java.security.cert.CertificateException;
import java.security.cert.X509Certificate;
import java.util.stream.Stream;

@Configuration
public class FabricConfig {

    @Value("${fabric.networkConfigPath}") private String networkConfigPath;
    @Value("${fabric.certificatePath}") private String certificatePath;
    @Value("${fabric.privateKeyPath}") private String privateKeyPath;
    @Value("${fabric.mspid}") private String mspid;
    @Value("${fabric.username}") private String username;
    @Value("${fabric.channelName}") private String channelName;
    @Value("${fabric.contractName}") private String contractName;

    @Bean
    public Contract contract() throws Exception {
        X509Certificate certificate = readX509Certificate(Paths.get(certificatePath));
        PrivateKey privateKey = getPrivateKey(Paths.get(privateKeyPath));

        Wallet wallet = Wallets.newInMemoryWallet();
        wallet.put(username, Identities.newX509Identity(mspid, certificate, privateKey));

        Gateway.Builder builder = Gateway.createBuilder()
                .identity(wallet, username)
                .networkConfig(Paths.get(networkConfigPath))
                .discovery(true);

        Gateway gateway = builder.connect();
        Network network = gateway.getNetwork(channelName);
        return network.getContract(contractName);
    }

    private static X509Certificate readX509Certificate(final Path certificatePath) throws IOException, CertificateException {
        try (Reader certificateReader = Files.newBufferedReader(certificatePath, StandardCharsets.UTF_8)) {
            return Identities.readX509Certificate(certificateReader);
        }
    }

    private static PrivateKey getPrivateKey(final Path privateKeyPath) throws IOException, InvalidKeyException {
        try (Stream<Path> walk = Files.walk(privateKeyPath.getParent())) {
            Path keyFile = walk.filter(p -> p.toString().endsWith("_sk") || p.toString().contains("priv_sk"))
                    .findFirst()
                    .orElseThrow(() -> new IOException("No private key found in " + privateKeyPath));
            try (Reader privateKeyReader = Files.newBufferedReader(keyFile, StandardCharsets.UTF_8)) {
                return Identities.readPrivateKey(privateKeyReader);
            }
        }
    }
}
