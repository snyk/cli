import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

plugins {
	val kotlinVersion = "1.3.21"
	id("org.jetbrains.kotlin.jvm") version kotlinVersion
	id("org.jetbrains.kotlin.plugin.spring") version kotlinVersion
	id("org.jetbrains.kotlin.plugin.jpa") version kotlinVersion
}

version = "1.0.0-SNAPSHOT"

tasks.withType<KotlinCompile> {
	kotlinOptions {
		jvmTarget = "1.8"
		freeCompilerArgs = listOf("-Xjsr305=strict")
	}
}

tasks.withType<Test> {
	useJUnitPlatform()
}

repositories {
	mavenCentral()
}

dependencies {
  // Removed Spring because too heavy
	compile("org.jetbrains.kotlin:kotlin-stdlib-jdk8")
	testCompile("org.jetbrains.kotlin:kotlin-reflect") {
		exclude(module = "junit")
	}
}
