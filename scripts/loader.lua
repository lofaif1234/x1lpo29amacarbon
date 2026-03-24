local placeId = game.PlaceId
local groupId = nil
if game.CreatorType == Enum.CreatorType.Group then
	groupId = game.CreatorId
end

if placeId == 142823291 or placeId == 335132309 or groupId == 142823291 then
	loadstring(game:HttpGet("https://raw.githubusercontent.com/CStudios-Dev/csLoader.lua/main/mm2.lua"))()

elseif placeId == 6042520 or groupId == 6042520 then
	loadstring(game:HttpGet("https://raw.githubusercontent.com/CStudios-Dev/csLoader.lua/main/99nights.lua"))()

elseif placeId == 35489258 or groupId == 35489258 then
	loadstring(game:HttpGet("https://raw.githubusercontent.com/CStudios-Dev/csLoader.lua/main/forge.lua"))()

elseif placeId == 4372130 or placeId == 2753915549 or placeId == 4442272183 or placeId == 7449423635 or groupId == 4372130 then
	loadstring(game:HttpGet("https://raw.githubusercontent.com/CStudios-Dev/csLoader.lua/main/bloxfruits.lua"))()

elseif placeId == 33548380 or groupId == 33548380 then
	loadstring(game:HttpGet("https://raw.githubusercontent.com/CStudios-Dev/csLoader.lua/main/forsaken.lua"))()

elseif placeId == 139823084840 or groupId == 411609583 then
	loadstring(game:HttpGet("https://raw.githubusercontent.com/CStudios-Dev/csLoader.lua/main/EscapeTsunamiForBrainrot.lua"))()

elseif placeId == 119987266683883 or groupId == 876852426 then
	loadstring(game:HttpGet("https://raw.githubusercontent.com/CStudios-Dev/csLoader.lua/main/survivelava.lua"))()

elseif placeId == 10449761463 then
	loadstring(game:HttpGet("https://raw.githubusercontent.com/CStudios-Dev/csLoader.lua/main/tsbg.lua"))()

elseif placeId == 127742093697776 or placeId == 127746984869880 then
	loadstring(game:HttpGet("https://raw.githubusercontent.com/CStudios-Dev/csLoader.lua/main/pvb.lua"))()

elseif placeId == 4520749081 or placeId == 6381829480 or placeId == 15759515082 or placeId == 5931540094 then
	loadstring(game:HttpGet("https://raw.githubusercontent.com/CStudios-Dev/csLoader.lua/main/kinglegacy.lua"))()

else
	local name = "Unknown"
	pcall(function() name = game:GetService("MarketplaceService"):GetProductInfo(placeId).Name end)
	game:GetService("StarterGui"):SetCore("SendNotification", {
		Title = "Not Supported",
		Text = name .. " is not supported yet",
		Duration = 5
	})
end