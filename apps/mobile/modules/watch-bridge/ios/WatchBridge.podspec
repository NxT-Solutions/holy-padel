Pod::Spec.new do |s|
  s.name           = 'WatchBridge'
  s.version        = '1.0.0'
  s.summary        = 'Phone-side WatchConnectivity bridge for Holy Padel'
  s.description    = 'Pushes live match state to the Apple Watch and receives score/undo/start intents.'
  s.author         = 'Holy Padel'
  s.homepage       = 'https://github.com/NxT-Solutions/holy-padel'
  s.license        = 'MIT'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
