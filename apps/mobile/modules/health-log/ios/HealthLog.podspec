Pod::Spec.new do |s|
  s.name           = 'HealthLog'
  s.version        = '1.0.0'
  s.summary        = 'Logs finished padel matches to Apple Health'
  s.description    = 'Writes a completed match as a HealthKit workout. Write-only; the app never reads health data.'
  s.author         = 'Holy Padel'
  s.homepage       = 'https://github.com/NxT-Solutions/holy-padel'
  s.license        = 'MIT'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'HealthKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
