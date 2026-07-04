plugins {
    id("com.android.application") version "9.2.0" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.4.0" apply false
}

// AGP 9 bundles Kotlin; pin the Kotlin Gradle plugin to 2.4.0 so it matches the
// Compose compiler plugin version exactly (the usual cause of Compose build breaks).
buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:2.4.0")
    }
}
