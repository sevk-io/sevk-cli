class Sevk < Formula
  desc "Manage your email infrastructure from the terminal"
  homepage "https://sevk.io"
  version "1.0.0"
  license "MIT"

  depends_on "node"

  on_macos do
    depends_on arch: :arm64
    url "https://github.com/sevk-io/sevk-cli/releases/download/v#{version}/sevk-darwin-arm64.tar.gz"
    sha256 "d7b15c63f4d9789f96885db0972550087b01f998d5f29e867228d12e4fe34a39"
  end

  on_linux do
    on_arm do
      url "https://github.com/sevk-io/sevk-cli/releases/download/v#{version}/sevk-linux-arm64.tar.gz"
      sha256 "504df434e6736a8304be985221d857b288c515a836fceda42d0e501b59641a12"
    end
    on_intel do
      url "https://github.com/sevk-io/sevk-cli/releases/download/v#{version}/sevk-linux-x64.tar.gz"
      sha256 "f89c817047f59ebcfccdc6164a534d8b55b956a2c56a92005893aae91d39d8f2"
    end
  end

  def install
    libexec.install "sevk", "package.json"
    bin.write_exec_script libexec/"sevk"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/sevk --version")
  end
end
