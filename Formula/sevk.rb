class Sevk < Formula
  desc "Manage your email infrastructure from the terminal"
  homepage "https://sevk.io"
  version "0.1.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/sevk-io/sevk-cli/releases/download/v#{version}/sevk-darwin-arm64.tar.gz"
      sha256 "PLACEHOLDER"
    end
    on_intel do
      url "https://github.com/sevk-io/sevk-cli/releases/download/v#{version}/sevk-darwin-x64.tar.gz"
      sha256 "PLACEHOLDER"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/sevk-io/sevk-cli/releases/download/v#{version}/sevk-linux-arm64.tar.gz"
      sha256 "PLACEHOLDER"
    end
    on_intel do
      url "https://github.com/sevk-io/sevk-cli/releases/download/v#{version}/sevk-linux-x64.tar.gz"
      sha256 "PLACEHOLDER"
    end
  end

  def install
    bin.install "sevk"
  end

  test do
    assert_match "sevk", shell_output("#{bin}/sevk --version")
  end
end
