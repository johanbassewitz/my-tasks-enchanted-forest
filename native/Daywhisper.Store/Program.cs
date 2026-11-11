using System.Text;
using System.Text.Json;
using Windows.ApplicationModel;

// Windows package startup only. All commerce uses Paddle through the backend.
internal static class Program
{
    private static async Task<int> Main(string[] args)
    {
        Console.OutputEncoding = new UTF8Encoding(false);
        try
        {
            if (args.Length != 3 || args[0] != "startup" || args[1] != "--action" || args[2] is not ("status" or "enable" or "disable"))
                throw new ArgumentException("Unsupported startup command.");
            _ = Package.Current.Id.Name;
            var task = await StartupTask.GetAsync("DaywhisperStartup");
            var state = task.State;
            if (args[2] == "enable") state = await task.RequestEnableAsync();
            else if (args[2] == "disable") { task.Disable(); state = task.State; }
            Console.WriteLine(JsonSerializer.Serialize(new { ok = true, action = "startup", state = state.ToString() }));
            return 0;
        }
        catch
        {
            Console.WriteLine(JsonSerializer.Serialize(new { ok = false, error = "Windows package startup is unavailable." }));
            return 1;
        }
    }
}
