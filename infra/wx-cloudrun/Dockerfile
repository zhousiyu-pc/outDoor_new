# Packaging draft only; build context is the repository root.
# Build the Boot JAR locally first. Production launch is intentionally blocked
# until authentication, real-source and MySQL acceptance gates are complete.
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY backend-java/target/outdoor-business-0.1.0.jar app.jar
ENV PORT=18080 BIND_ADDRESS=0.0.0.0
EXPOSE 18080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
