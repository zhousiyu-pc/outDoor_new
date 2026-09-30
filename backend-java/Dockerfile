# Build the JAR locally before creating an image. This does not install dependencies.
# Production remains blocked until authentication, source and MySQL gates are complete.
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY target/outdoor-business-0.1.0.jar app.jar
ENV PORT=18080 BIND_ADDRESS=0.0.0.0
EXPOSE 18080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
