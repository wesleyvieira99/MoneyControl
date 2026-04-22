package com.moneycontrol.service;

import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.concurrent.TimeUnit;

@Service
public class BackupGitService {

    private static final long CMD_TIMEOUT_SECONDS = 90;

    public CommandResult run(Path workingDir, String... command) throws Exception {
        ProcessBuilder pb = new ProcessBuilder(command);
        pb.directory(workingDir.toFile());
        pb.redirectErrorStream(true);

        Process process = pb.start();
        StringBuilder output = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(
            new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append(System.lineSeparator());
            }
        }

        boolean finished = process.waitFor(CMD_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        if (!finished) {
            process.destroyForcibly();
            throw new RuntimeException("Timeout ao executar comando git: " + String.join(" ", command));
        }

        int exitCode = process.exitValue();
        return new CommandResult(exitCode, output.toString().trim(), String.join(" ", Arrays.asList(command)));
    }

    public record CommandResult(int exitCode, String output, String command) {
        public boolean ok() {
            return exitCode == 0;
        }
    }
}
