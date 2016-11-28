# coding: utf-8

Gem::Specification.new do |spec|
  spec.name          = "ruby-gem"
  spec.version       = "0.1.0"
  spec.authors       = ["Snyk"]
  spec.email         = ["snyk@snyk.io"]

  spec.summary       = "Example Gemspec"
  spec.homepage      = ""


  spec.files         = `git ls-files -z`.split("\x0").reject do |f|
    f.match(%r{^(test|spec|features)/})
  end
  spec.bindir        = "exe"
  spec.executables   = spec.files.grep(%r{^exe/}) { |f| File.basename(f) }

  spec.add_development_dependency "bundler", "~> 1.13"
  spec.add_development_dependency "rake", "~> 10.0"
end
