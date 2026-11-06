using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Windows.ApplicationModel;
using Windows.Services.Store;

internal static class Program
{
    private const string StartupTaskId = "DaywhisperStartup";
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsWindow(IntPtr handle);

    private static async Task<int> Main(string[] args)
    {
        Console.OutputEncoding = new UTF8Encoding(false);
        try
        {
            var (action, options) = Parse(args);
            // An unpackaged process must never masquerade as a Store-enabled app.
            _ = Package.Current.Id.Name;
            if (action == "startup")
            {
                var task = await StartupTask.GetAsync(StartupTaskId);
                var requested = options["--action"];
                var state = task.State;
                if (requested == "enable") state = await task.RequestEnableAsync();
                else if (requested == "disable") { task.Disable(); state = task.State; }
                Write(new { ok = true, action, state = state.ToString() });
                return 0;
            }

            if (!long.TryParse(options["--hwnd"], NumberStyles.None, CultureInfo.InvariantCulture, out var numericHandle) || numericHandle <= 0)
                throw new ArgumentException("A valid owner window is required.");
            var handle = new IntPtr(numericHandle);
            if (!IsWindow(handle)) throw new ArgumentException("The owner window is no longer available.");
            var context = StoreContext.GetDefault();
            WinRT.Interop.InitializeWithWindow.Initialize(context, handle);

            if (action == "status")
            {
                var license = await context.GetAppLicenseAsync();
                // License verification remains authoritative when the online catalog is unavailable.
                StoreProduct[] availableProducts = Array.Empty<StoreProduct>();
                try
                {
                    availableProducts = await ReadCatalog(context).WaitAsync(TimeSpan.FromSeconds(10));
                }
                catch { /* Missing prices must not revoke an existing Store license. */ }
                var activeSkuIds = license.AddOnLicenses.Values
                    .Where(item => item.IsActive)
                    .Select(item => item.SkuStoreId).Distinct().OrderBy(id => id).ToArray();
                var products = availableProducts.OrderBy(item => item.StoreId).Select(item => new
                {
                    storeId = item.StoreId,
                    title = item.Title,
                    price = item.Price.FormattedPrice,
                    // A collection entry alone is not proof of an active durable license.
                    owned = item.Skus.Any(sku => activeSkuIds.Contains(sku.StoreId))
                }).ToArray();
                Write(new { ok = true, action, products, license = new { isActive = license.IsActive, isTrial = license.IsTrial, activeSkuIds } });
            }
            else
            {
                var id = options["--store-id"];
                // Only allow add-ons actually associated with this package to reach purchase UI.
                var query = await context.GetAssociatedStoreProductsAsync(new[] { "Durable" });
                if (query.ExtendedError is not null) throw query.ExtendedError;
                if (!query.Products.Values.Any(product => product.StoreId == id))
                    throw new ArgumentException("This product is not available for this application.");
                var result = await context.RequestPurchaseAsync(id);
                Write(new { ok = true, action, storeId = id, status = result.Status.ToString(), extendedError = result.ExtendedError is null ? null : HResult(result.ExtendedError) });
            }
            return 0;
        }
        catch (Exception error)
        {
            Write(new { ok = false, error = new { code = HResult(error), message = error is ArgumentException ? error.Message : "Microsoft Store could not complete this request. Check your connection and installed Store package." } });
            return 1;
        }
    }

    private static (string action, Dictionary<string, string> options) Parse(string[] args)
    {
        if (args.Length == 0 || args[0] is not ("status" or "purchase" or "startup")) throw new ArgumentException("Unsupported Store command.");
        var options = new Dictionary<string, string>();
        for (var i = 1; i < args.Length; i += 2)
            if (i + 1 >= args.Length || !options.TryAdd(args[i], args[i + 1])) throw new ArgumentException("Invalid Store command options.");
        var expected = args[0] switch { "status" => new[] { "--hwnd" }, "purchase" => new[] { "--hwnd", "--store-id" }, _ => new[] { "--action" } };
        if (options.Count != expected.Length || expected.Any(key => !options.ContainsKey(key))) throw new ArgumentException("Invalid Store command options.");
        if (args[0] == "startup" && options["--action"] is not ("status" or "enable" or "disable")) throw new ArgumentException("Unsupported startup action.");
        if (args[0] == "purchase" && !Regex.IsMatch(options["--store-id"], @"\A[A-Za-z0-9]{6,32}\z")) throw new ArgumentException("Invalid Store product identifier.");
        return (args[0], options);
    }
    private static async Task<StoreProduct[]> ReadCatalog(StoreContext context)
    {
        var query = await context.GetAssociatedStoreProductsAsync(new[] { "Durable" });
        return query.ExtendedError is null ? query.Products.Values.ToArray() : Array.Empty<StoreProduct>();
    }
    private static string HResult(Exception error) => $"0x{error.HResult:X8}";
    private static void Write(object result) => Console.WriteLine(JsonSerializer.Serialize(result));
}
