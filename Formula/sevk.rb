class Sevk < Formula
  desc "Manage your email infrastructure from the terminal"
  homepage "https://sevk.io"
  version "1.1.0"
  license "MIT"

  depends_on "node"

  on_macos do
    depends_on arch: :arm64
    url "https://github.com/sevk-io/sevk-cli/releases/download/v#{version}/sevk-darwin-arm64.tar.gz"
    sha256 "7570bc2a88897ca5bdba9521200a4440d56de7a8b38f94d5c219fb4161852d9b"
  end

  on_linux do
    on_arm do
      url "https://github.com/sevk-io/sevk-cli/releases/download/v#{version}/sevk-linux-arm64.tar.gz"
      sha256 "f31f1ab94500890e5752889e048e6cff81cb42b9192adb1e2b7e78d20abe151e"
    end
    on_intel do
      url "https://github.com/sevk-io/sevk-cli/releases/download/v#{version}/sevk-linux-x64.tar.gz"
      sha256 "b982ced1bc15368f5ef70ce4d0447684d34f0d3da70db10d4c3ea69e07c8a91a"
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
